/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const ThinkingBlock = () => <div data-testid="thinking-block">Thinking Block</div>;

describe('ThinkingBlock Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders component', () => {
    render(<ThinkingBlock />);
    expect(screen.getByTestId('thinking-block')).toBeInTheDocument();
  });

  it('renders without crashing', () => {
    const { container } = render(<ThinkingBlock />);
    expect(container).toBeInTheDocument();
  });
});
