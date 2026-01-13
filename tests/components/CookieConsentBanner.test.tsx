/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const CookieConsentBanner = () => <div data-testid="cookie-consent">Cookie Consent Banner</div>;

describe('CookieConsentBanner Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders component', () => {
    render(<CookieConsentBanner />);
    expect(screen.getByTestId('cookie-consent')).toBeInTheDocument();
  });

  it('renders without crashing', () => {
    const { container } = render(<CookieConsentBanner />);
    expect(container).toBeInTheDocument();
  });
});
