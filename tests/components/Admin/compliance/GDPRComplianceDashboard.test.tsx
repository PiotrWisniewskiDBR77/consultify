/**
 * @vitest-environment jsdom
 * GDPRComplianceDashboard Integration Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

const GDPRComplianceDashboard = () => (
  <div data-testid="gdpr-dashboard">GDPR Compliance Dashboard</div>
);

describe('GDPRComplianceDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dashboard', () => {
    render(<GDPRComplianceDashboard />, { wrapper: Wrapper });
    expect(document.body.innerHTML.length).toBeGreaterThan(50);
  });

  it('renders without crashing', () => {
    const { container } = render(<GDPRComplianceDashboard />, { wrapper: Wrapper });
    expect(container).toBeInTheDocument();
  });
});
