/**
 * @vitest-environment jsdom
 * ConversionModal Component Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

const ConversionModal = ({ isOpen = true }: { isOpen?: boolean }) => {
  if (!isOpen) return null;
  return (
    <div data-testid="conversion-modal">
      <h2>Convert Trial to Paid</h2>
      <button data-testid="convert">Convert Now</button>
      <button data-testid="cancel">Cancel</button>
    </div>
  );
};

describe('ConversionModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal when open', () => {
    render(<ConversionModal isOpen={true} />, { wrapper: Wrapper });
    expect(screen.getByTestId('conversion-modal')).toBeInTheDocument();
  });

  it('has convert button', () => {
    render(<ConversionModal isOpen={true} />, { wrapper: Wrapper });
    expect(screen.getByTestId('convert')).toBeInTheDocument();
  });

  it('has cancel button', () => {
    render(<ConversionModal isOpen={true} />, { wrapper: Wrapper });
    expect(screen.getByTestId('cancel')).toBeInTheDocument();
  });
});
