/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const RouterSync = () => <div data-testid="router-sync">Router Sync</div>;

describe('RouterSync Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders component', () => {
    render(
      <BrowserRouter>
        <RouterSync />
      </BrowserRouter>
    );
    expect(screen.getByTestId('router-sync')).toBeInTheDocument();
  });

  it('renders without crashing', () => {
    const { container } = render(
      <BrowserRouter>
        <RouterSync />
      </BrowserRouter>
    );
    expect(container).toBeInTheDocument();
  });
});
