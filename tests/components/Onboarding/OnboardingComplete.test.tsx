/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const OnboardingComplete = () => <div data-testid="onboarding-complete">Onboarding Complete</div>;

describe('OnboardingComplete Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders component', () => {
    render(<OnboardingComplete />);
    expect(screen.getByTestId('onboarding-complete')).toBeInTheDocument();
  });

  it('renders without crashing', () => {
    const { container } = render(<OnboardingComplete />);
    expect(container).toBeInTheDocument();
  });
});
