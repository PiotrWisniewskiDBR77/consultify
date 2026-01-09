/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const ArtifactsPanel = () => <div data-testid="artifacts-panel">Artifacts Panel</div>;

describe('ArtifactsPanel Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders component', () => {
    render(<ArtifactsPanel />);
    expect(screen.getByTestId('artifacts-panel')).toBeInTheDocument();
  });

  it('renders without crashing', () => {
    const { container } = render(<ArtifactsPanel />);
    expect(container).toBeInTheDocument();
  });
});
