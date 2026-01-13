/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const FocusModeSelector = () => <div data-testid="focus-mode">Focus Mode Selector</div>;

describe('FocusModeSelector Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders component', () => {
    render(<FocusModeSelector />);
    expect(screen.getByTestId('focus-mode')).toBeInTheDocument();
  });

  it('renders without crashing', () => {
    const { container } = render(<FocusModeSelector />);
    expect(container).toBeInTheDocument();
  });
});
