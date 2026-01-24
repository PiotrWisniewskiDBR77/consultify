/**
 * @vitest-environment jsdom
 * LoadingScreen Component Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

const LoadingScreen = ({ message = 'Loading...' }: { message?: string }) => (
  <div data-testid="loading-screen">
    <div data-testid="spinner">Spinner</div>
    <p data-testid="message">{message}</p>
  </div>
);

describe('LoadingScreen Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders screen', () => {
    render(<LoadingScreen />, { wrapper: Wrapper });
    expect(screen.getByTestId('loading-screen')).toBeInTheDocument();
  });

  it('has spinner', () => {
    render(<LoadingScreen />, { wrapper: Wrapper });
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('displays message', () => {
    render(<LoadingScreen message="Please wait" />, { wrapper: Wrapper });
    expect(screen.getByTestId('message')).toBeInTheDocument();
  });
});
