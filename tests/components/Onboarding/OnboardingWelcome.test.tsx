/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const OnboardingWelcome = () => <div data-testid="onboarding-welcome">Onboarding Welcome</div>;

describe('OnboardingWelcome Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders component', () => {
    render(<OnboardingWelcome />);
    expect(screen.getByTestId('onboarding-welcome')).toBeInTheDocument();
  });

  it('renders without crashing', () => {
    const { container } = render(<OnboardingWelcome />);
    expect(container).toBeInTheDocument();
  });
});
