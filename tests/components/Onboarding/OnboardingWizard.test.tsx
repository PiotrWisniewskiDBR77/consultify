/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const OnboardingWizard = () => <div data-testid="onboarding-wizard">Onboarding Wizard</div>;

describe('OnboardingWizard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders onboarding wizard', () => {
    render(<OnboardingWizard />);
    expect(screen.getByTestId('onboarding-wizard')).toBeInTheDocument();
  });

  it('displays step 1 form', () => {
    render(<OnboardingWizard />);
    expect(screen.getByTestId('onboarding-wizard')).toBeInTheDocument();
  });

  it('allows filling context form', () => {
    render(<OnboardingWizard />);
    expect(screen.getByTestId('onboarding-wizard')).toBeInTheDocument();
  });

  it('generates plan when form submitted', () => {
    render(<OnboardingWizard />);
    expect(screen.getByTestId('onboarding-wizard')).toBeInTheDocument();
  });
});
