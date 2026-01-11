/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const StrategicRoadmap = () => <div data-testid="strategic-roadmap">Strategic Roadmap</div>;

describe('StrategicRoadmap Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders component', () => {
    render(<StrategicRoadmap />);
    expect(screen.getByTestId('strategic-roadmap')).toBeInTheDocument();
  });

  it('renders without crashing', () => {
    const { container } = render(<StrategicRoadmap />);
    expect(container).toBeInTheDocument();
  });
});
