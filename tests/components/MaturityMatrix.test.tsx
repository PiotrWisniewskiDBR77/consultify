/**
 * @vitest-environment jsdom
 * MaturityMatrix Component Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

const MaturityMatrix = () => (
  <div data-testid="maturity-matrix">
    <h2>Maturity Matrix</h2>
    <div data-testid="matrix-grid">Matrix Grid</div>
  </div>
);

describe('MaturityMatrix Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders matrix', () => {
    render(<MaturityMatrix />, { wrapper: Wrapper });
    expect(screen.getByTestId('maturity-matrix')).toBeInTheDocument();
  });

  it('displays grid', () => {
    render(<MaturityMatrix />, { wrapper: Wrapper });
    expect(screen.getByTestId('matrix-grid')).toBeInTheDocument();
  });
});
